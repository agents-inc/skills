# Vue 3 Composition API - defineExpose Examples

> Exposing component methods to parent. See [SKILL.md](../SKILL.md) for concepts.

---

## Form Field with Exposed Methods

### Good Example - Child component with defineExpose

```vue
<!-- FormField.vue -->
<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  label: string;
  modelValue: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const hasError = ref(false);
const errorMessage = ref("");

function validate(): boolean {
  if (props.modelValue.length === 0) {
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
  emit("update:modelValue", "");
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
    <input
      ref="inputRef"
      :value="modelValue"
      @input="
        emit('update:modelValue', ($event.target as HTMLInputElement).value)
      "
    />
    <span v-if="hasError" class="error">{{ errorMessage }}</span>
  </div>
</template>
```

**Why good:** defineExpose creates explicit public API, only exposes what's needed, combines methods and reactive state

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

**Why good:** InstanceType provides correct typing, parent can call child methods, focused error handling UX, clear form management

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

// Access exposed ref
const isValid = childRef.value?.hasError ?? false;
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
