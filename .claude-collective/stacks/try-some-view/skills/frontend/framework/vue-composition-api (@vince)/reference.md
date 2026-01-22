# Vue 3 Composition API Reference

> Decision frameworks, anti-patterns, and red flags for Vue 3 Composition API development. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Frameworks

### When to Use ref() vs reactive()

```
What type of data are you managing?
├─ Primitive (string, number, boolean)?
│   └─ Use ref() ✓
├─ Single object with nested properties?
│   └─ Use reactive() ✓
├─ Array of items?
│   ├─ Will you reassign the entire array?
│   │   └─ YES → Use ref() (can reassign .value)
│   │   └─ NO → Either works, prefer ref() for consistency
└─ Need to destructure for template?
    └─ Use ref() (destructuring reactive loses reactivity)
```

### When to Use computed() vs watch()

```
Do you need to derive a new value?
├─ YES → Use computed() ✓
│   (cached, re-evaluated only when dependencies change)
└─ NO → Do you need to perform side effects?
    ├─ YES → Use watch() or watchEffect()
    │   ├─ Need old value?
    │   │   └─ Use watch() ✓
    │   ├─ Need explicit sources?
    │   │   └─ Use watch() ✓
    │   └─ Simple dependency tracking?
    │       └─ Use watchEffect() ✓
    └─ NO → You probably don't need either
```

### When to Use watch() vs watchEffect()

```
Do you need access to the previous value?
├─ YES → Use watch() ✓
└─ NO → Do you want explicit control over what's watched?
    ├─ YES → Use watch() with specific sources ✓
    └─ NO → Do you want automatic dependency tracking?
        ├─ YES → Use watchEffect() ✓
        └─ NO → Use watch() for clarity
```

### When to Extract a Composable

```
Is this logic reused across components?
├─ YES → Extract to composable ✓
└─ NO → Is this logic complex (>30 lines)?
    ├─ YES → Does it handle a distinct concern?
    │   ├─ YES → Extract to composable for organization ✓
    │   └─ NO → Keep inline
    └─ NO → Keep inline in component
```

### When to Use Provide/Inject

```
Is this data needed by deeply nested components?
├─ YES → Would prop drilling create 3+ intermediate components?
│   ├─ YES → Use provide/inject ✓
│   └─ NO → Consider props (simpler)
└─ NO → Is this app-wide configuration/context?
    ├─ YES → Consider provide/inject or state management
    └─ NO → Use props
```

### When to Use defineExpose

```
Does parent need to call child methods?
├─ YES → Use defineExpose() ✓
└─ NO → Does parent need to read child state directly?
    ├─ YES → Consider emitting events instead (preferred)
    │   └─ If imperative access needed → Use defineExpose() ✓
    └─ NO → Don't use defineExpose (components are private by default)
```

### When to Use defineModel vs defineProps/defineEmits (Vue 3.4+)

```
Does component need two-way binding (v-model)?
├─ YES → How many v-model bindings?
│   ├─ Single → defineModel() ✓
│   └─ Multiple → defineModel('name') for each ✓
└─ NO → Does component only read props (no emit)?
    ├─ YES → defineProps() ✓
    └─ NO → defineProps() + defineEmits() ✓
```

### When to Use useTemplateRef vs ref() (Vue 3.5+)

```
Need a template ref?
├─ Is the ref attribute dynamic (changes at runtime)?
│   └─ YES → useTemplateRef() ✓
├─ Need to share ref logic in a composable?
│   └─ YES → useTemplateRef() ✓
└─ Simple static ref in single component?
    └─ Either works, ref() is more familiar
```

### When to Use useId (Vue 3.5+)

```
Need unique ID for form element or ARIA attribute?
├─ YES → Is this SSR or may become SSR?
│   └─ YES → useId() ✓ (prevents hydration mismatch)
└─ Client-only app with simple needs?
    └─ useId() still recommended for consistency
```

---

## RED FLAGS

### High Priority Issues

- **Missing cleanup in onUnmounted** - Timers, event listeners, subscriptions, and WebSocket connections must be cleaned up to prevent memory leaks
- **Accessing ref.value outside script** - Template auto-unwraps refs, writing `.value` in templates is wrong
- **Destructuring reactive() without toRefs()** - Loses reactivity, always use `toRefs(state)` when destructuring
- **Missing `use` prefix on composables** - Convention violation, breaks discoverability and IDE support
- **Not using `<script setup>`** - Adds unnecessary boilerplate, prefer script setup for all new components

### Medium Priority Issues

- **Using reactive() for primitives** - Verbose and error-prone, use ref() for primitives
- **Watch without cleanup for async operations** - Can cause race conditions, use `onWatcherCleanup` or the cleanup callback
- **Missing type annotations on refs** - `ref()` infers types, but complex types need explicit annotation
- **Not handling loading/error states in async composables** - Always return isLoading and error refs
- **Using provide without InjectionKey** - Loses type safety, always use typed InjectionKey symbols

### Common Mistakes

- **Modifying props directly** - Props are read-only, emit events to request changes
- **Forgetting `immediate: true` on watch** - Watch is lazy by default, use immediate for initial run
- **Using `this` in script setup** - No `this` context exists in script setup, use variables directly
- **Reactive object reassignment** - Loses reactivity, mutate properties instead or use ref()
- **Missing null checks on template refs** - Refs are null before mount, use optional chaining

### Gotchas and Edge Cases

- **Refs in reactive objects are auto-unwrapped** at root level, but NOT in arrays or Map/Set
- **watchEffect runs immediately** unlike watch which is lazy by default
- **computed values are read-only** by default, use getter/setter object for writable
- **Template refs must match variable name** exactly with the `ref="name"` attribute (or use `useTemplateRef()` in Vue 3.5+)
- **defineExpose is required** for parent to access script setup component's properties
- **Top-level await makes component async** and requires Suspense in parent
- **Provide values are not reactive by default** - wrap in ref() or reactive() if needed
- **onUnmounted won't run if component errors** during setup - use error boundaries
- **Destructured props require getter in watch** (Vue 3.5+) - `watch(() => count)` not `watch(count)`
- **useId() must not be called in computed** - generates new ID each call, use in setup only
- **defineModel returns a ref** - use `.value` in script, auto-unwrapped in template

---

## Anti-Patterns

### Mutating Props Directly

Props are read-only in Vue. Emit events to request changes from the parent.

```typescript
// WRONG - Mutating props
const props = defineProps<{ count: number }>();
function increment() {
  props.count++; // ❌ Runtime warning, no reactivity
}

// CORRECT - Emit events
const emit = defineEmits<{ update: [count: number] }>();
function increment() {
  emit("update", props.count + 1); // ✅ Parent handles update
}
```

### Destructuring reactive() Incorrectly

Destructuring a reactive object breaks reactivity.

```typescript
// WRONG - Loses reactivity
const state = reactive({ count: 0, name: "Vue" });
const { count, name } = state; // ❌ count and name are not reactive

// CORRECT - Use toRefs
import { toRefs } from "vue";
const { count, name } = toRefs(state); // ✅ Refs preserve reactivity

// ALSO CORRECT - Access directly without destructuring
state.count++;
```

### Missing Cleanup for Side Effects

Failing to clean up causes memory leaks.

```typescript
// WRONG - No cleanup
onMounted(() => {
  window.addEventListener("resize", handleResize);
  setInterval(pollData, 5000);
});

// CORRECT - Proper cleanup
let intervalId: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  window.addEventListener("resize", handleResize);
  intervalId = setInterval(pollData, 5000);
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
});
```

### Watch Without Async Cleanup

Async operations in watch can race without cleanup.

```typescript
// WRONG - Race condition
watch(searchQuery, async (query) => {
  const results = await fetch(`/api/search?q=${query}`);
  // Old request might complete after new one
  searchResults.value = await results.json();
});

// CORRECT - With cleanup (Vue 3.5+)
watch(searchQuery, async (query) => {
  const controller = new AbortController();
  onWatcherCleanup(() => controller.abort());

  try {
    const response = await fetch(`/api/search?q=${query}`, {
      signal: controller.signal,
    });
    searchResults.value = await response.json();
  } catch (e) {
    if (e.name !== "AbortError") throw e;
  }
});
```

### Using reactive() for Values That Will Be Reassigned

Reassigning a reactive variable breaks reactivity.

```typescript
// WRONG - Loses reactivity on reassignment
let state = reactive({ items: [] });
state = reactive({ items: newItems }); // ❌ Components won't update

// CORRECT - Use ref for reassignable values
const items = ref<Item[]>([]);
items.value = newItems; // ✅ Reactivity preserved

// ALSO CORRECT - Mutate reactive properties
const state = reactive({ items: [] as Item[] });
state.items = newItems; // ✅ Property mutation is tracked
```

### Not Using TypeScript with defineProps

Losing compile-time type safety.

```typescript
// WRONG - Runtime-only validation, no TypeScript integration
const props = defineProps({
  userId: String,
  count: Number,
});
// props.userId is typed as string | undefined, even when required

// CORRECT - TypeScript type declaration
const props = defineProps<{
  userId: string;
  count?: number;
}>();
// Full type safety and IDE support
```

### Composables Without Return Object

Returning values inconsistently makes composables hard to use.

```typescript
// WRONG - Inconsistent returns
function useCounter() {
  const count = ref(0);
  return count; // Just the ref, no methods
}

// CORRECT - Return object with state and methods
function useCounter() {
  const count = ref(0);
  const increment = () => count.value++;
  const decrement = () => count.value--;
  const reset = () => (count.value = 0);

  return {
    count,
    increment,
    decrement,
    reset,
  };
}
```

### provide() Without Type Safety

Losing types between provider and consumer.

```typescript
// WRONG - No type safety
provide("user", currentUser);
const user = inject("user"); // user is unknown

// CORRECT - InjectionKey provides type safety
import type { InjectionKey, Ref } from "vue";

export const USER_KEY: InjectionKey<Ref<User>> = Symbol("user");

// Provider
provide(USER_KEY, currentUser);

// Consumer - fully typed
const user = inject(USER_KEY); // Ref<User> | undefined
```

---

## Quick Reference

### Composable Checklist

- [ ] Function name starts with `use` prefix
- [ ] Returns an object with refs and methods (not bare values)
- [ ] Accepts `MaybeRefOrGetter` for reactive inputs when appropriate
- [ ] Uses `toValue()` to normalize ref/getter/plain inputs
- [ ] Includes cleanup in `onUnmounted` for any side effects
- [ ] Returns loading and error refs for async operations
- [ ] Has TypeScript types for parameters and return value
- [ ] Uses named constants for magic numbers

### Component Checklist

- [ ] Uses `<script setup>` syntax
- [ ] Props defined with TypeScript via `defineProps<T>()`
- [ ] Emits defined with TypeScript via `defineEmits<T>()`
- [ ] Template refs use matching variable names
- [ ] Uses `defineExpose()` if parent needs access
- [ ] Cleans up side effects in `onUnmounted`
- [ ] Uses computed for derived state (not inline calculations)
- [ ] Uses named constants for all magic numbers

### Watch Checklist

- [ ] Uses correct source type (ref, getter for reactive property, or array)
- [ ] Sets `immediate: true` if callback should run on mount
- [ ] Sets `deep: true` for watching nested object changes
- [ ] Includes cleanup for async operations
- [ ] Uses `flush: 'post'` if DOM access needed in callback

### Provide/Inject Checklist

- [ ] Uses `InjectionKey<T>` for type safety
- [ ] Key is a unique Symbol
- [ ] Provider wraps value in ref/reactive if reactivity needed
- [ ] Consumer checks for undefined (missing provider)
- [ ] Consumer throws meaningful error if provider required

---

## TypeScript Patterns

### Typing Refs

```typescript
// Primitive types are inferred
const count = ref(0); // Ref<number>
const name = ref(""); // Ref<string>

// Complex types need annotation
const user = ref<User | null>(null);
const items = ref<Item[]>([]);

// Union types
const status = ref<"idle" | "loading" | "error">("idle");
```

### Typing Props with Defaults (Vue 3.5+)

```typescript
// Reactive destructure with defaults
const {
  title,
  count = 0,
  items = () => [], // Factory for non-primitives
} = defineProps<{
  title: string;
  count?: number;
  items?: string[];
}>();
```

### Typing Emits

```typescript
// Named tuple syntax (Vue 3.3+)
const emit = defineEmits<{
  update: [id: string, value: number];
  delete: [id: string];
  submit: [];
}>();
```

### Typing Template Refs

```typescript
// DOM element ref
const inputRef = ref<HTMLInputElement | null>(null);

// Component ref
import MyComponent from "./MyComponent.vue";
const compRef = ref<InstanceType<typeof MyComponent> | null>(null);
```

### Typing Composable Returns

```typescript
interface UseCounterReturn {
  count: Ref<number>;
  isAtMax: ComputedRef<boolean>;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}

function useCounter(max?: number): UseCounterReturn {
  // ...implementation
}
```
