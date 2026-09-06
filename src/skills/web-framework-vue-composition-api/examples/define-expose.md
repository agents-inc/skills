# Vue 3 Composition API - defineExpose Examples

> Exposing component methods to parent. See [SKILL.md](../SKILL.md) for concepts.

---

## Form Field with Exposed Methods

### Good Example - Child component with defineExpose

```vue
<!-- FormField.vue -->
<script setup lang="ts">
import { ref } from "vue";

defineProps<{ label: string }>();

const model = defineModel<string>({ required: true });

const inputRef = ref<HTMLInputElement | null>(null);
const hasError = ref(false);
const errorMessage = ref("");

function validate(): boolean {
  if (model.value.length === 0) {
    hasError.value = true;
    errorMessage.value = "Field is required";
    return false;
  }
  hasError.value = false;
  errorMessage.value = "";
  return true;
}

function focus() {
  inputRef.value?.focus();
}

function clear() {
  model.value = "";
  hasError.value = false;
  errorMessage.value = "";
}

// Expose specific methods to parent
defineExpose({
  validate,
  focus,
  clear,
  hasError,
});
</script>

<template>
  <div class="form-field">
    <label>{{ label }}</label>
    <input ref="inputRef" v-model="model" />
    <span v-if="hasError" class="error">{{ errorMessage }}</span>
  </div>
</template>
```

**Why good:** `defineExpose` states the public API explicitly and exposes nothing else, while `defineModel()` (3.4+) covers the v-model half in one line instead of a `modelValue` prop paired with an `update:modelValue` emit.

---

## Parent Using Exposed Methods

### Good Example - Parent form using child methods

```vue
<!-- ParentForm.vue -->
<script setup lang="ts">
import { ref } from "vue";
import FormField from "./FormField.vue";

const nameField = ref<InstanceType<typeof FormField> | null>(null);
const emailField = ref<InstanceType<typeof FormField> | null>(null);

const name = ref("");
const email = ref("");

async function handleSubmit() {
  const nameValid = nameField.value?.validate() ?? false;
  const emailValid = emailField.value?.validate() ?? false;

  if (!nameValid) {
    nameField.value?.focus();
    return;
  }

  if (!emailValid) {
    emailField.value?.focus();
    return;
  }

  // Submit form...
}

function resetForm() {
  nameField.value?.clear();
  emailField.value?.clear();
}
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <FormField ref="nameField" v-model="name" label="Name" />
    <FormField ref="emailField" v-model="email" label="Email" />
    <button type="submit">Submit</button>
    <button type="button" @click="resetForm">Reset</button>
  </form>
</template>
```

**Why good:** InstanceType types the exposed surface, the parent calls child methods through it, and the first invalid field takes focus

---

## Type Safety Pattern

### Typing Component Refs

```typescript
import { ref } from "vue";
import ChildComponent from "./ChildComponent.vue";

// Full type safety for exposed methods
const childRef = ref<InstanceType<typeof ChildComponent> | null>(null);

// Call exposed method with autocomplete
childRef.value?.exposedMethod();

// Access an exposed ref — Vue unwraps it, so this is a boolean, not a Ref
const hasError = childRef.value?.hasError ?? false;
```

### What Gets Exposed

```vue
<script setup lang="ts">
const privateState = ref("hidden"); // NOT exposed
const publicState = ref("visible"); // Will be exposed

function privateMethod() {} // NOT exposed
function publicMethod() {} // Will be exposed

// Only these are accessible from parent
defineExpose({
  publicState,
  publicMethod,
});
</script>
```

---

## When to Use defineExpose

**Use defineExpose for:**

- Imperative actions (focus, validate, scroll)
- Form field validation APIs
- Modal/dialog open/close methods
- Animation triggers
- Accessing child component state for coordination

**Avoid defineExpose for:**

- Data that should flow via props/events
- State that changes frequently (use events instead)
- Breaking one-way data flow unnecessarily

---

## See Also

- [core.md](core.md) - Template refs basics
- [composables.md](composables.md) - Reusable logic patterns
