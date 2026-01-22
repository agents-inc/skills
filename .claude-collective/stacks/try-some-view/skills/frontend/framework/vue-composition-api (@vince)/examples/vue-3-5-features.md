# Vue 3.4+ / 3.5+ Feature Examples

> New APIs introduced in Vue 3.4 and 3.5. See [SKILL.md](../SKILL.md) for concepts.

---

## defineModel (Vue 3.4+)

### Good Example - Basic v-model with defineModel

```vue
<!-- TextInput.vue -->
<script setup lang="ts">
// ✅ Single line replaces defineProps + defineEmits
const model = defineModel<string>();
</script>

<template>
  <input v-model="model" type="text" />
</template>
```

```vue
<!-- Parent.vue -->
<script setup lang="ts">
import { ref } from "vue";
import TextInput from "./TextInput.vue";

const message = ref("");
</script>

<template>
  <TextInput v-model="message" />
  <p>Message: {{ message }}</p>
</template>
```

**Why good:** defineModel handles prop declaration and emit automatically, direct v-model binding works, ref-like API for mutations

### Bad Example - Manual props/emits for v-model

```vue
<!-- TextInput.vue -->
<script setup lang="ts">
// ❌ Verbose pattern - use defineModel instead
const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  emit("update:modelValue", target.value);
}
</script>

<template>
  <input :value="modelValue" @input="handleInput" />
</template>
```

**Why bad:** Boilerplate code that defineModel eliminates, manual event handling is error-prone

---

## defineModel with Multiple v-models

### Good Example - Named models

```vue
<!-- UserNameInput.vue -->
<script setup lang="ts">
const firstName = defineModel<string>("firstName", { required: true });
const lastName = defineModel<string>("lastName", { required: true });
</script>

<template>
  <div class="user-name-input">
    <input v-model="firstName" placeholder="First name" />
    <input v-model="lastName" placeholder="Last name" />
  </div>
</template>
```

```vue
<!-- Parent.vue -->
<script setup lang="ts">
import { ref } from "vue";
import UserNameInput from "./UserNameInput.vue";

const first = ref("John");
const last = ref("Doe");
</script>

<template>
  <UserNameInput v-model:first-name="first" v-model:last-name="last" />
  <p>Full name: {{ first }} {{ last }}</p>
</template>
```

**Why good:** Each model independently bound, kebab-case in parent maps to camelCase, type-safe with required option

---

## defineModel with Modifiers

### Good Example - Custom modifier handling

```vue
<!-- CapitalizedInput.vue -->
<script setup lang="ts">
const [model, modifiers] = defineModel<string>({
  set(value) {
    if (modifiers.capitalize && value) {
      return value.charAt(0).toUpperCase() + value.slice(1);
    }
    if (modifiers.uppercase) {
      return value?.toUpperCase() ?? "";
    }
    return value;
  },
});
</script>

<template>
  <input v-model="model" type="text" />
</template>
```

```vue
<!-- Usage -->
<template>
  <!-- First letter capitalized -->
  <CapitalizedInput v-model.capitalize="text1" />

  <!-- All uppercase -->
  <CapitalizedInput v-model.uppercase="text2" />
</template>
```

**Why good:** Modifiers accessible via destructure, setter transforms before emit, supports multiple modifiers

---

## useTemplateRef (Vue 3.5+)

### Good Example - Basic useTemplateRef

```vue
<script setup lang="ts">
import { useTemplateRef, onMounted } from "vue";

const inputRef = useTemplateRef<HTMLInputElement>("myInput");

onMounted(() => {
  inputRef.value?.focus();
});

function selectAll() {
  inputRef.value?.select();
}
</script>

<template>
  <input ref="myInput" type="text" />
  <button @click="selectAll">Select All</button>
</template>
```

**Why good:** String-based binding is explicit, works in composables, clear separation from reactive refs

### Good Example - useTemplateRef in composable

```typescript
// composables/use-auto-focus.ts
import { useTemplateRef, onMounted } from "vue";

export function useAutoFocus(refName: string) {
  const element = useTemplateRef<HTMLElement>(refName);

  onMounted(() => {
    element.value?.focus();
  });

  return element;
}
```

```vue
<!-- Component.vue -->
<script setup lang="ts">
import { useAutoFocus } from "@/composables/use-auto-focus";

// Will auto-focus on mount
const inputRef = useAutoFocus("searchInput");
</script>

<template>
  <input ref="searchInput" type="text" placeholder="Search..." />
</template>
```

**Why good:** Composable can accept ref name as parameter, reusable focus logic, clean component code

---

## useId (Vue 3.5+)

### Good Example - Form accessibility with useId

```vue
<script setup lang="ts">
import { useId } from "vue";

const emailId = useId();
const passwordId = useId();
</script>

<template>
  <form>
    <div>
      <label :for="emailId">Email</label>
      <input :id="emailId" type="email" autocomplete="email" />
    </div>
    <div>
      <label :for="passwordId">Password</label>
      <input :id="passwordId" type="password" autocomplete="current-password" />
    </div>
  </form>
</template>
```

**Why good:** SSR-safe unique IDs, each call generates different ID, no hydration mismatch, proper label association for accessibility

### Good Example - ARIA attributes with useId

```vue
<script setup lang="ts">
import { useId, ref } from "vue";

const descriptionId = useId();
const hasError = ref(false);
const errorMessage = ref("");
</script>

<template>
  <div>
    <input
      type="text"
      :aria-describedby="descriptionId"
      :aria-invalid="hasError"
    />
    <p :id="descriptionId">
      {{ hasError ? errorMessage : "Enter your username" }}
    </p>
  </div>
</template>
```

**Why good:** Proper ARIA relationship, accessible error messaging, stable IDs across SSR

---

## Reactive Props Destructure (Vue 3.5+)

### Good Example - Destructuring with defaults

```vue
<script setup lang="ts">
import { watch } from "vue";

const {
  title,
  count = 0,
  items = () => [], // Factory for arrays/objects
  disabled = false,
} = defineProps<{
  title: string;
  count?: number;
  items?: string[];
  disabled?: boolean;
}>();

// ⚠️ IMPORTANT: Use getter for watch
watch(
  () => count,
  (newCount) => {
    console.log("Count changed:", newCount);
  },
);
</script>

<template>
  <div :class="{ disabled }">
    <h2>{{ title }}</h2>
    <span>Count: {{ count }}</span>
    <ul>
      <li v-for="item in items" :key="item">{{ item }}</li>
    </ul>
  </div>
</template>
```

**Why good:** Native JavaScript default syntax, cleaner than withDefaults, props remain reactive in Vue 3.5+

### Bad Example - Direct watch on destructured prop

```vue
<script setup lang="ts">
const { count = 0 } = defineProps<{ count?: number }>();

// ❌ WRONG - passes value, not reactive source
watch(count, (newCount) => {
  console.log("Count:", newCount); // Never triggers!
});
</script>
```

**Why bad:** Destructured prop is a value at time of destructure, watch needs a getter or ref to track changes

---

## onWatcherCleanup (Vue 3.5+)

### Good Example - Cancelling fetch requests

```vue
<script setup lang="ts">
import { ref, watch, onWatcherCleanup } from "vue";

const searchQuery = ref("");
const results = ref<SearchResult[]>([]);

watch(searchQuery, async (query) => {
  if (!query) {
    results.value = [];
    return;
  }

  const controller = new AbortController();

  // ✅ Register cleanup to abort on new search
  onWatcherCleanup(() => controller.abort());

  try {
    const response = await fetch(`/api/search?q=${query}`, {
      signal: controller.signal,
    });
    results.value = await response.json();
  } catch (e) {
    if (e instanceof Error && e.name !== "AbortError") {
      throw e;
    }
  }
});
</script>
```

**Why good:** Prevents race conditions, cancels outdated requests, cleaner than manual cleanup tracking

---

## Deferred Teleport (Vue 3.5+)

### Good Example - Teleport to Vue-rendered target

```vue
<script setup lang="ts">
import { ref } from "vue";

const showModal = ref(false);
</script>

<template>
  <button @click="showModal = true">Open Modal</button>

  <!-- Container rendered by Vue -->
  <div id="modal-container"></div>

  <!-- Teleport with defer waits for container to exist -->
  <Teleport to="#modal-container" defer>
    <div v-if="showModal" class="modal">
      <h2>Modal Content</h2>
      <button @click="showModal = false">Close</button>
    </div>
  </Teleport>
</template>
```

**Why good:** defer prop allows teleporting to elements rendered in same template, solves timing issues with Vue-rendered containers

---

## See Also

- [core.md](core.md) - Basic component patterns
- [composables.md](composables.md) - Using new APIs in composables
- [reactivity.md](reactivity.md) - Reactive props details
