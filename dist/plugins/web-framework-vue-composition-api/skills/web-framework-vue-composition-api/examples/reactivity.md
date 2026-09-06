# Vue 3 Composition API - Reactivity Examples

> Patterns for ref(), reactive(), and computed(). See [SKILL.md](../SKILL.md) for concepts.

---

## ref() for Primitives and Anything Reassigned

### Good Example - Primitive refs with computed

```typescript
import { ref, computed } from "vue";

const MAX_ITEMS = 100;
const DEFAULT_PAGE_SIZE = 20;

// Primitive refs
const count = ref(0);
const searchQuery = ref("");
const isEnabled = ref(true);
const selectedId = ref<string | null>(null);

// Array ref (array of primitives)
const tags = ref<string[]>([]);

// Computed derived from refs
const hasSelection = computed(() => selectedId.value !== null);
const tagCount = computed(() => tags.value.length);

// Methods that modify refs
function increment() {
  if (count.value < MAX_ITEMS) {
    count.value++;
  }
}

function addTag(tag: string) {
  if (!tags.value.includes(tag)) {
    tags.value.push(tag);
  }
}

function clearSelection() {
  selectedId.value = null;
}
```

**Why good:** ref for primitives is idiomatic, computed for derived state, named constants for the limits, and a null union where the value is genuinely optional

---

## reactive() for Objects

### Good Example - Reactive objects with toRefs

```typescript
import { reactive, toRefs } from "vue";

interface FormState {
  name: string;
  email: string;
  age: number | null;
  preferences: {
    newsletter: boolean;
    notifications: boolean;
  };
}

const DEFAULT_AGE = null;

// Reactive object for complex state
const form = reactive<FormState>({
  name: "",
  email: "",
  age: DEFAULT_AGE,
  preferences: {
    newsletter: false,
    notifications: true,
  },
});

// Direct property access (no .value)
function updateEmail(email: string) {
  form.email = email;
}

function toggleNewsletter() {
  form.preferences.newsletter = !form.preferences.newsletter;
}

function resetForm() {
  form.name = "";
  form.email = "";
  form.age = DEFAULT_AGE;
  form.preferences.newsletter = false;
  form.preferences.notifications = true;
}

// Convert to refs if needed for destructuring
const { name, email } = toRefs(form);
```

**Why good:** direct property access reads naturally for an object mutated in place, `toRefs` preserves reactivity when destructuring, and the interface fixes the shape.

**Caveat:** `reactive()` holds object types only, cannot be reassigned, and loses reactivity when destructured — which is why Vue's own guide recommends `ref()` as the primary API for declaring reactive state. Reach for `reactive()` where one object is mutated in place and the `.value` hops genuinely cost readability.

---

## Anti-Patterns

### Bad Example - Reassigning or destructuring a reactive object

```typescript
import { reactive } from "vue";

let form = reactive({ name: "", email: "" });

// BAD: a new proxy is bound here; the template still holds the old one
function reset() {
  form = reactive({ name: "", email: "" });
}

// BAD: destructuring copies values out of the proxy
const { name } = form; // a plain string, disconnected from form.name
```

**Why bad:** `reactive()` tracks through property access on one proxy, so both the reassignment and the destructure sever the connection — and neither throws, so the UI simply stops updating.

### Good Example - Mutate in place, destructure through toRefs

```typescript
import { reactive, toRefs } from "vue";

const form = reactive({ name: "", email: "" });

function reset() {
  Object.assign(form, { name: "", email: "" }); // same proxy, new values
}

const { name, email } = toRefs(form); // refs, still connected
```

**Why good:** `Object.assign` keeps the identity the template is holding, and `toRefs` hands out refs rather than copies. Where the whole value gets replaced, `ref()` avoids the question entirely — reassigning `.value` is exactly what a ref tracks.

---

## Decision Framework

```
Will the whole value be replaced (a fetch result, a null-to-object swap)?
├─ YES → ref() — reassigning .value is tracked
└─ NO → Is it a primitive?
    ├─ YES → ref() — reactive() holds object types only
    └─ NO → One object, mutated in place, no destructuring at the call site?
        ├─ YES → reactive() — property access, no .value
        └─ NO → ref(), or reactive() plus toRefs() at every destructure
```

---

## See Also

- [core.md](core.md) - Complete component setup patterns
- [composables.md](composables.md) - Using reactivity in composables
