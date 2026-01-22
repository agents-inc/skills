# VeeValidate - Core Examples

> Essential patterns for VeeValidate v4. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Additional Examples:**

- [validation.md](validation.md) - Schema validation integration
- [arrays.md](arrays.md) - useFieldArray for dynamic forms

---

## Pattern 1: Basic Form with defineField

### Good Example - Type-safe form with validation

```vue
<script setup lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";

const MIN_PASSWORD_LENGTH = 8;

const schema = toTypedSchema(
  z.object({
    email: z.string().min(1, "Email is required").email("Invalid email"),
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `At least ${MIN_PASSWORD_LENGTH} characters`),
    rememberMe: z.boolean().optional(),
  }),
);

const { handleSubmit, errors, defineField, isSubmitting } = useForm({
  validationSchema: schema,
  initialValues: {
    email: "",
    password: "",
    rememberMe: false,
  },
});

const [email, emailAttrs] = defineField("email");
const [password, passwordAttrs] = defineField("password");
const [rememberMe, rememberMeAttrs] = defineField("rememberMe");

const onSubmit = handleSubmit(async (values) => {
  // values is typed: { email: string; password: string; rememberMe?: boolean }
  await loginUser(values);
});
</script>

<template>
  <form @submit="onSubmit">
    <div>
      <label for="email">Email</label>
      <input
        id="email"
        v-model="email"
        v-bind="emailAttrs"
        type="email"
        :aria-invalid="!!errors.email"
      />
      <span v-if="errors.email" role="alert">{{ errors.email }}</span>
    </div>

    <div>
      <label for="password">Password</label>
      <input
        id="password"
        v-model="password"
        v-bind="passwordAttrs"
        type="password"
        :aria-invalid="!!errors.password"
      />
      <span v-if="errors.password" role="alert">{{ errors.password }}</span>
    </div>

    <div>
      <label>
        <input v-model="rememberMe" v-bind="rememberMeAttrs" type="checkbox" />
        Remember me
      </label>
    </div>

    <button type="submit" :disabled="isSubmitting">
      {{ isSubmitting ? "Logging in..." : "Log in" }}
    </button>
  </form>
</template>
```

**Why good:** toTypedSchema provides full type inference from schema, initialValues prevents undefined warnings, aria-invalid ensures accessibility, isSubmitting disables button during submission, named constant for MIN_PASSWORD_LENGTH, role="alert" announces errors to screen readers

### Bad Example - Missing types and poor patterns

```vue
<script setup>
import { useForm } from "vee-validate";

// WRONG: No schema, no types
const { handleSubmit, errors, defineField } = useForm();

const [email] = defineField("email");
const [password] = defineField("password");

const onSubmit = handleSubmit((values) => {
  // values is 'any' - no type safety
  loginUser(values);
});
</script>

<template>
  <form @submit="onSubmit">
    <!-- WRONG: No initialValues, missing accessibility -->
    <input v-model="email" />
    <span v-if="errors.email">{{ errors.email }}</span>

    <input v-model="password" type="password" />
    <!-- WRONG: Magic number in inline validation -->
    <span v-if="password.length < 8">Too short</span>

    <button type="submit">Login</button>
  </form>
</template>
```

**Why bad:** no TypeScript generics or schema means no autocomplete or type checking, missing initialValues can cause undefined behavior, magic number 8 not documented as constant, missing aria-invalid breaks accessibility, inline validation duplicates schema logic

---

## Pattern 2: Form with Inline Validation Rules

For simple forms without schema libraries.

### Good Example - Using validation rules

```vue
<script setup lang="ts">
import { useForm, useField } from "vee-validate";

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 50;

interface ContactForm {
  name: string;
  email: string;
  message: string;
}

const { handleSubmit, errors } = useForm<ContactForm>({
  initialValues: {
    name: "",
    email: "",
    message: "",
  },
});

// useField with inline validation function
const { value: name } = useField<string>("name", (value) => {
  if (!value) return "Name is required";
  if (value.length < MIN_NAME_LENGTH)
    return `At least ${MIN_NAME_LENGTH} characters`;
  if (value.length > MAX_NAME_LENGTH)
    return `Max ${MAX_NAME_LENGTH} characters`;
  return true;
});

const { value: email } = useField<string>("email", (value) => {
  if (!value) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Invalid email format";
  return true;
});

const { value: message } = useField<string>("message");

const onSubmit = handleSubmit(async (values) => {
  await sendContactForm(values);
});
</script>

<template>
  <form @submit="onSubmit">
    <div>
      <label for="name">Name</label>
      <input id="name" v-model="name" :aria-invalid="!!errors.name" />
      <span v-if="errors.name" role="alert">{{ errors.name }}</span>
    </div>

    <div>
      <label for="email">Email</label>
      <input
        id="email"
        v-model="email"
        type="email"
        :aria-invalid="!!errors.email"
      />
      <span v-if="errors.email" role="alert">{{ errors.email }}</span>
    </div>

    <div>
      <label for="message">Message</label>
      <textarea id="message" v-model="message" />
    </div>

    <button type="submit">Send</button>
  </form>
</template>
```

**Why good:** inline validation functions work without schema libraries, validation functions return error message or true for valid, named constants for MIN_NAME_LENGTH and MAX_NAME_LENGTH, optional fields (message) don't need validation

---

## Pattern 3: Custom Input Component with useField

### Good Example - Reusable text input

```vue
<!-- components/form-input.vue -->
<script setup lang="ts">
import { useField } from "vee-validate";
import { toRef } from "vue";

interface Props {
  name: string;
  label: string;
  type?: "text" | "email" | "password" | "tel";
  placeholder?: string;
}

const props = withDefaults(defineProps<Props>(), {
  type: "text",
  placeholder: "",
});

// CRITICAL: Use function form for reactivity
const { value, errorMessage, handleBlur, handleChange, meta } =
  useField<string>(() => props.name, undefined, {
    validateOnValueUpdate: false,
  });
</script>

<template>
  <div class="form-field">
    <label :for="name">{{ label }}</label>
    <input
      :id="name"
      :name="name"
      :type="type"
      :value="value"
      :placeholder="placeholder"
      :aria-invalid="meta.touched && !!errorMessage"
      :aria-describedby="errorMessage ? `${name}-error` : undefined"
      @input="handleChange"
      @blur="handleBlur"
    />
    <span
      v-if="meta.touched && errorMessage"
      :id="`${name}-error`"
      role="alert"
    >
      {{ errorMessage }}
    </span>
  </div>
</template>
```

**Usage in parent form:**

```vue
<script setup lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";
import FormInput from "./components/form-input.vue";

const schema = toTypedSchema(
  z.object({
    username: z.string().min(3, "At least 3 characters"),
    email: z.string().email("Invalid email"),
  }),
);

const { handleSubmit } = useForm({
  validationSchema: schema,
  initialValues: { username: "", email: "" },
});

const onSubmit = handleSubmit((values) => {
  console.log(values);
});
</script>

<template>
  <form @submit="onSubmit">
    <FormInput name="username" label="Username" />
    <FormInput name="email" label="Email" type="email" />
    <button type="submit">Submit</button>
  </form>
</template>
```

**Why good:** function form `() => props.name` maintains reactivity when name changes, validateOnValueUpdate: false shows errors only after blur, aria-describedby links error message to input for screen readers, component is reusable across forms

### Bad Example - Losing reactivity

```vue
<script setup lang="ts">
import { useField } from "vee-validate";

const props = defineProps<{ name: string }>();

// WRONG: Direct prop access loses reactivity
const { value, errorMessage } = useField(props.name);
</script>
```

**Why bad:** passing `props.name` directly (not as function) means useField won't react to prop changes, if parent changes the name prop the field won't update, should use `() => props.name` or `toRef(props, 'name')`

---

## Pattern 4: Form Meta State

### Good Example - Using meta for UX

```vue
<script setup lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";

const schema = toTypedSchema(
  z.object({
    title: z.string().min(1, "Required"),
    content: z.string().min(10, "At least 10 characters"),
  }),
);

const { handleSubmit, meta, isSubmitting, resetForm, defineField, values } =
  useForm({
    validationSchema: schema,
    initialValues: { title: "", content: "" },
  });

const [title] = defineField("title");
const [content] = defineField("content");

const onSubmit = handleSubmit(async (data) => {
  await savePost(data);
  // Reset form with new defaults (clears dirty state)
  resetForm({ values: data });
});

const handleCancel = () => {
  // Reset to initial values
  resetForm();
};
</script>

<template>
  <form @submit="onSubmit">
    <input v-model="title" placeholder="Title" />
    <textarea v-model="content" placeholder="Content" />

    <div class="form-actions">
      <button type="button" :disabled="!meta.dirty" @click="handleCancel">
        Cancel
      </button>
      <button
        type="submit"
        :disabled="!meta.valid || !meta.dirty || isSubmitting"
      >
        {{ isSubmitting ? "Saving..." : "Save" }}
      </button>
    </div>

    <p v-if="meta.dirty" class="unsaved-warning">You have unsaved changes</p>
  </form>
</template>
```

**Why good:** meta.dirty enables cancel button only when changes exist, meta.valid combined with meta.dirty enables smart submit button state, resetForm(values) clears dirty state while keeping new values, isSubmitting prevents double submission

### Meta Properties Reference

| Property             | Type      | Description                    |
| -------------------- | --------- | ------------------------------ |
| `meta.valid`         | `boolean` | Form passes all validation     |
| `meta.dirty`         | `boolean` | Any field differs from initial |
| `meta.touched`       | `boolean` | Any field has been blurred     |
| `meta.pending`       | `boolean` | Async validation in progress   |
| `meta.initialValues` | `object`  | Initial form values            |

---

## Pattern 5: Eager Validation Strategy

Lazy initially, aggressive after first error.

```vue
<script setup lang="ts">
import { useField } from "vee-validate";
import { computed } from "vue";

const props = defineProps<{ name: string }>();

const { value, errorMessage, handleBlur, handleChange, meta } =
  useField<string>(() => props.name);

// Eager validation: lazy first, aggressive after error
const validationListeners = computed(() => ({
  blur: (evt: Event) => handleBlur(evt, true), // Always validate on blur
  change: handleChange,
  // Validate on input ONLY if there's already an error
  input: (evt: Event) => handleChange(evt, !!errorMessage.value),
}));
</script>

<template>
  <input
    :value="value"
    v-on="validationListeners"
    :aria-invalid="!!errorMessage"
  />
  <span v-if="errorMessage" role="alert">{{ errorMessage }}</span>
</template>
```

**Why good:** shows errors only after blur (non-intrusive), once error exists validates on every keystroke for immediate feedback, best UX balance between validation timing

---
