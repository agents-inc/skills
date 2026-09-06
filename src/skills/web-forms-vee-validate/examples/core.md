# VeeValidate - Core Examples

> Essential patterns for VeeValidate v4. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Additional Examples:**

- [validation.md](validation.md) - schema through toTypedSchema, conditional validation, errorBag
- [arrays.md](arrays.md) - useFieldArray for repeatable groups

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

**Why good:** `toTypedSchema` types `values` from the schema, `v-bind="…Attrs"` attaches the handlers
that drive validation timing, `initialValues` covers every field, and `aria-invalid` with
`role="alert"` announces each error to a screen reader.

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

**Why bad:** with no schema and no generic, `values` is untyped and nothing validates — the template
compensates with a hand-written length check, which is a second rule in a second place that no
submit path consults. Without `initialValues` the fields start undefined, and the bare inputs give a
screen reader nothing to announce.

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

**Why good:** an inline validator is a plain function of the value returning a message or `true`, so
no schema library is needed. Each one sees only its own field — which is the limit of the approach,
and the reason cross-field rules go through `validationSchema` instead.

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

// Getter form, so the binding follows the name prop if it changes
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

const onSubmit = handleSubmit(async (values) => {
  await submitForm(values);
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

**Why good:** `() => props.name` keeps the binding live if the parent changes the name,
`validateOnValueUpdate: false` holds errors back to blur, and `aria-describedby` ties the message to
the input so a screen reader reads them together. The component takes a name and nothing else, so
any form can drop it in.

### Bad Example - Losing reactivity

```vue
<script setup lang="ts">
import { useField } from "vee-validate";

const props = defineProps<{ name: string }>();

// WRONG: Direct prop access loses reactivity
const { value, errorMessage } = useField(props.name);
</script>
```

**Why bad:** `props.name` is read once during setup, so the field stays bound to the name it mounted
with. Pass `() => props.name` or `toRef(props, "name")` instead.

---

## Pattern 4: Form Meta State

### Good Example - Using meta for UX

```vue
<script setup lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";

const MIN_CONTENT_LENGTH = 10;

const schema = toTypedSchema(
  z.object({
    title: z.string().min(1, "Required"),
    content: z
      .string()
      .min(MIN_CONTENT_LENGTH, `At least ${MIN_CONTENT_LENGTH} characters`),
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

**Why good:** `meta.dirty` and `meta.valid` together mean the submit button is live only when there
is something valid to save, and `resetForm({ values: data })` makes the saved data the new baseline
so `dirty` returns to false without discarding it.

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

**Why good:** nothing is reported while the user is first filling the field, and once it has failed
each keystroke re-checks — so the message clears the moment the value becomes valid rather than at
the next blur.

---
