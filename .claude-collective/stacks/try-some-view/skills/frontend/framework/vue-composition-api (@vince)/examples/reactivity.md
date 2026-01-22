# Vue 3 Composition API - Reactivity Examples

> Patterns for ref(), reactive(), and computed(). See [SKILL.md](../SKILL.md) for concepts.

---

## ref() for Primitives

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

**Why good:** ref for primitives is idiomatic, explicit .value access, computed for derived state, named constants for limits, null type union for optional values

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

**Why good:** reactive for complex nested state, direct property access is natural, toRefs preserves reactivity when destructuring, typed interface for shape

---

## Anti-Patterns

### Bad Example - Mixing ref and reactive incorrectly

```typescript
import { ref, reactive } from "vue";

// ref for complex object - inconsistent with convention
const user = ref({
  name: "John",
  email: "john@example.com",
  settings: {
    theme: "dark",
  },
});

// Confusing: need .value for object but not for nested
user.value.name = "Jane";
user.value.settings.theme = "light";

// reactive for primitive - loses reactivity on reassignment
const count = reactive({ value: 0 });
// Later someone might do:
// count = { value: 5 }  // BREAKS REACTIVITY
```

**Why bad:** ref for complex objects adds unnecessary .value, reactive for primitives is verbose and error-prone, inconsistent patterns confuse readers

---

## Decision Framework

```
Is it a primitive (string, number, boolean)?
├─ YES → ref()
└─ NO → Is it a complex object with nested properties?
    ├─ YES → reactive()
    └─ NO → ref() (for arrays or simple objects)

Need to destructure reactive object?
├─ YES → toRefs() to preserve reactivity
└─ NO → Access properties directly
```

---

## See Also

- [core.md](core.md) - Complete component setup patterns
- [composables.md](composables.md) - Using reactivity in composables
