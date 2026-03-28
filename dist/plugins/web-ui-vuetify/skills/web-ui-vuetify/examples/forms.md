# Vuetify -- Forms & Validation

> v-form validation, rules arrays, useRules composable, input component patterns, and multi-step forms. See [SKILL.md](../SKILL.md) for overview.

**Related examples:**

- [core.md](core.md) -- Plugin setup, theming, defaults
- [data-tables.md](data-tables.md) -- Data table patterns
- [layout.md](layout.md) -- Grid system, layout components

---

## Form Validation with useRules (v3.8+)

```vue
<script setup>
import { ref } from "vue";
import { useRules } from "vuetify/labs/rules";

const form = (ref < HTMLFormElement) | (null > null);
const name = ref("");
const email = ref("");
const password = ref("");

const rules = useRules();

async function onSubmit() {
  if (!form.value) return;
  const { valid } = await form.value.validate();
  if (!valid) return;
  // All fields passed validation -- proceed
}
</script>

<template>
  <v-form ref="form" validate-on="submit" @submit.prevent="onSubmit">
    <v-text-field v-model="name" label="Name" :rules="[rules.required()]" />
    <v-text-field
      v-model="email"
      label="Email"
      type="email"
      :rules="[rules.required(), rules.email()]"
    />
    <v-text-field
      v-model="password"
      label="Password"
      type="password"
      :rules="[rules.required(), rules.minLength(8)]"
    />
    <v-btn type="submit" color="primary" block>Submit</v-btn>
  </v-form>
</template>
```

**Key points:**

- `useRules()` is imported from `"vuetify/labs/rules"` (lab API as of v3.8)
- Rule builders return validation functions: `rules.required()` returns `(v) => !!v || "Field is required"`
- `validate-on="submit"` prevents validation noise until the user submits -- alternatives: `"blur"`, `"input"`, `"blur lazy"`, `"submit lazy"`
- `form.validate()` returns `{ valid: boolean }` -- always `await` it (async validators are supported)

---

## Custom Validation Rules

```typescript
// Custom rule functions: return true or an error message string
type ValidationRule = (value: string) => true | string;

const MIN_PASSWORD_LENGTH = 8;

const customRules = {
  required: (v: string) => !!v || "This field is required",
  email: (v: string) => /.+@.+\..+/.test(v) || "Must be a valid email",
  minLength:
    (min: number): ValidationRule =>
    (v: string) =>
      v.length >= min || `Must be at least ${min} characters`,
  matchField:
    (fieldValue: () => string, label: string): ValidationRule =>
    (v: string) =>
      v === fieldValue() || `Must match ${label}`,
  numeric: (v: string) => /^\d+$/.test(v) || "Must contain only numbers",
  url: (v: string) =>
    /^https?:\/\/.+/.test(v) || "Must be a valid URL starting with http(s)://",
};
```

```vue
<template>
  <v-text-field
    v-model="password"
    label="Password"
    :rules="[customRules.required, customRules.minLength(MIN_PASSWORD_LENGTH)]"
  />
  <v-text-field
    v-model="confirmPassword"
    label="Confirm Password"
    :rules="[
      customRules.required,
      customRules.matchField(() => password, 'Password'),
    ]"
  />
</template>
```

**Key points:**

- Rules are plain functions: `(value) => true | string`
- Parameterized rules return a rule function (closure pattern)
- Cross-field validation uses a getter function to access the other field's reactive value

---

## Programmatic Form Control

```vue
<script setup>
import { ref } from "vue";

const form = (ref < HTMLFormElement) | (null > null);

async function validateForm() {
  if (!form.value) return;
  const { valid } = await form.value.validate();
  return valid;
}

function resetForm() {
  form.value?.reset(); // Clears values AND validation state
}

function resetValidation() {
  form.value?.resetValidation(); // Clears errors but keeps values
}
</script>

<template>
  <v-form ref="form" validate-on="blur lazy">
    <v-text-field v-model="name" label="Name" :rules="[required]" />
    <v-row>
      <v-col>
        <v-btn color="primary" @click="validateForm">Validate</v-btn>
      </v-col>
      <v-col>
        <v-btn variant="outlined" @click="resetValidation">Clear Errors</v-btn>
      </v-col>
      <v-col>
        <v-btn variant="text" @click="resetForm">Reset</v-btn>
      </v-col>
    </v-row>
  </v-form>
</template>
```

**Key points:**

- `form.validate()` -- triggers validation on all children, returns `{ valid }`
- `form.reset()` -- clears all field values AND validation errors
- `form.resetValidation()` -- clears validation errors only, preserves values
- `validate-on="blur lazy"` means: validate on blur, but only after the first submission attempt

---

## Input Component Patterns

### Select with Object Items

```vue
<script setup>
import { ref } from "vue";

interface Country {
  code: string;
  name: string;
}

const selectedCountry = ref<Country | null>(null);

const countries: Country[] = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
];
</script>

<template>
  <v-select
    v-model="selectedCountry"
    :items="countries"
    item-title="name"
    item-value="code"
    label="Country"
    return-object
  />
</template>
```

**Key points:**

- `item-title` and `item-value` map object properties to display text and bound value
- `return-object` makes `v-model` bind the full object, not just the `item-value` property
- Without `return-object`, `v-model` binds the `item-value` string (e.g., `"US"`)

### Autocomplete with Custom Filtering

```vue
<script setup>
import { ref } from "vue";

const selected = ref(null);
const items = ref(["JavaScript", "TypeScript", "Python", "Rust", "Go"]);

function customFilter(value: string, query: string, item: any): boolean {
  return value.toLowerCase().startsWith(query.toLowerCase());
}
</script>

<template>
  <v-autocomplete
    v-model="selected"
    :items="items"
    :custom-filter="customFilter"
    label="Language"
    clearable
  />
</template>
```

### File Input with Preview

```vue
<script setup>
import { ref, computed } from "vue";

const MAX_FILE_SIZE_MB = 5;
const ACCEPTED_TYPES = "image/png, image/jpeg, image/webp";

const files = ref<File[]>([]);

const fileSizeRule = (file: File) =>
  file.size < MAX_FILE_SIZE_MB * 1024 * 1024 || `Max size is ${MAX_FILE_SIZE_MB}MB`;
</script>

<template>
  <v-file-input
    v-model="files"
    :accept="ACCEPTED_TYPES"
    :rules="[fileSizeRule]"
    label="Upload image"
    prepend-icon="mdi-camera"
    chips
    multiple
    show-size
  />
</template>
```

---

## Validation Timing Options

| `validate-on` Value | Behavior                                                |
| ------------------- | ------------------------------------------------------- |
| `"input"`           | Validates on every keystroke (noisy)                    |
| `"blur"`            | Validates when field loses focus                        |
| `"submit"`          | Validates only on form submit                           |
| `"blur lazy"`       | Validates on blur, but only after first submit attempt  |
| `"input lazy"`      | Validates on input, but only after first submit attempt |
| `"submit lazy"`     | Validates on submit, clears errors on next input        |

**Recommendation:** Use `"submit"` for simple forms, `"blur lazy"` for longer forms where inline feedback after first attempt improves UX.
